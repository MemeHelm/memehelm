// Dedicated indexed tables keep launch history out of the JSON document store.
// RPC work is always completed before these synchronous SQLite transactions.
export function createLaunchIndexRepository(connection){
  const schema=connection();
  try{schema.exec(`
    CREATE TABLE IF NOT EXISTS launch_index_states (
      identity TEXT PRIMARY KEY, chain_id INTEGER NOT NULL, factory TEXT NOT NULL, factory_code_hash TEXT NOT NULL,
      schema_version INTEGER NOT NULL, bootstrap_from INTEGER NOT NULL,
      next_block INTEGER NOT NULL, target_block INTEGER NOT NULL,
      last_success_at TEXT, last_attempt_at TEXT, verified_at TEXT, error TEXT,
      reorg_json TEXT, invalidated INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS launch_index_ranges (
      identity TEXT NOT NULL, from_block INTEGER NOT NULL, to_block INTEGER NOT NULL,
      end_hash TEXT NOT NULL, checked_at TEXT NOT NULL,
      PRIMARY KEY (identity, from_block)
    );
    CREATE INDEX IF NOT EXISTS launch_index_ranges_tip ON launch_index_ranges(identity, to_block DESC);
    CREATE TABLE IF NOT EXISTS launch_index_events (
      identity TEXT NOT NULL, transaction_hash TEXT NOT NULL, log_index INTEGER NOT NULL,
      block_number INTEGER NOT NULL, block_hash TEXT NOT NULL, created_at TEXT NOT NULL,
      token TEXT NOT NULL, curve TEXT NOT NULL, deployer TEXT NOT NULL, pair_token TEXT NOT NULL,
      args_json TEXT NOT NULL,
      PRIMARY KEY (identity, transaction_hash, log_index)
    );
    CREATE INDEX IF NOT EXISTS launch_index_events_order ON launch_index_events(identity, block_number DESC, log_index DESC);
    CREATE INDEX IF NOT EXISTS launch_index_events_deployer ON launch_index_events(identity, deployer, block_number DESC);
  `);
    const columns=new Set(schema.prepare('PRAGMA table_info(launch_index_states)').all().map(row=>row.name));
    if(!columns.has('factory_code_hash'))schema.exec("ALTER TABLE launch_index_states ADD COLUMN factory_code_hash TEXT NOT NULL DEFAULT ''");
    if(!columns.has('invalidated'))schema.exec('ALTER TABLE launch_index_states ADD COLUMN invalidated INTEGER NOT NULL DEFAULT 0');
  }finally{schema.close();}

  function access(work,transaction=false){
    const db=connection();
    try{
      if(transaction)db.exec('BEGIN IMMEDIATE');
      const result=work(db);
      if(transaction)db.exec('COMMIT');
      return result;
    }catch(error){if(transaction)try{db.exec('ROLLBACK');}catch{}throw error;}
    finally{db.close();}
  }
  const identityKey=identity=>identity.id;
  function present(row){return row?{
    identity:row.identity,chainId:row.chain_id,factory:row.factory,factoryCodeHash:row.factory_code_hash,schemaVersion:row.schema_version,
    bootstrapFrom:row.bootstrap_from,nextBlock:row.next_block,targetBlock:row.target_block,
    lastSuccessAt:row.last_success_at,lastAttemptAt:row.last_attempt_at,verifiedAt:row.verified_at,
    error:row.error,reorg:row.reorg_json?JSON.parse(row.reorg_json):null,invalidated:!!row.invalidated,
  }:null;}
  const state=(identity)=>access(db=>present(db.prepare('SELECT * FROM launch_index_states WHERE identity=?').get(identityKey(identity))));
  function conflict(){throw Object.assign(new Error('The launch index changed during this read. Retry its next range.'),{code:'INDEX_CONFLICT'});}
  return{
    initialize(identity,{fromBlock,targetBlock,at}){
      return access(db=>{
        db.prepare('INSERT OR IGNORE INTO launch_index_states(identity,chain_id,factory,factory_code_hash,schema_version,bootstrap_from,next_block,target_block,last_attempt_at) VALUES(?,?,?,?,?,?,?,?,?)')
          .run(identity.id,identity.chainId,identity.factory,identity.factoryCodeHash,identity.schemaVersion,fromBlock,fromBlock,targetBlock,at);
        db.prepare('UPDATE launch_index_states SET target_block=?,last_attempt_at=? WHERE identity=?').run(targetBlock,at,identity.id);
        return present(db.prepare('SELECT * FROM launch_index_states WHERE identity=?').get(identity.id));
      },true);
    },
    state,
    ranges(identity,{limit=8}={}){
      return access(db=>db.prepare('SELECT from_block,to_block,end_hash,checked_at FROM launch_index_ranges WHERE identity=? ORDER BY to_block DESC LIMIT ?').all(identityKey(identity),limit)
        .map(row=>({fromBlock:row.from_block,toBlock:row.to_block,endHash:row.end_hash,checkedAt:row.checked_at})));
    },
    events(identity,{limit=200}={}){
      return access(db=>db.prepare('SELECT transaction_hash,log_index,block_number,block_hash,created_at,args_json FROM launch_index_events WHERE identity=? AND EXISTS(SELECT 1 FROM launch_index_states WHERE identity=? AND invalidated=0) ORDER BY block_number DESC,log_index DESC LIMIT ?').all(identityKey(identity),identityKey(identity),limit)
        .map(row=>({transactionHash:row.transaction_hash,logIndex:row.log_index,blockNumber:row.block_number,blockHash:row.block_hash,createdAt:row.created_at,args:JSON.parse(row.args_json)})));
    },
    count:identity=>access(db=>db.prepare('SELECT COUNT(*) AS count FROM launch_index_events WHERE identity=? AND EXISTS(SELECT 1 FROM launch_index_states WHERE identity=? AND invalidated=0)').get(identityKey(identity),identityKey(identity)).count),
    commitRange(identity,{fromBlock,toBlock,endHash,events,at,targetBlock}){
      return access(db=>{
        const current=db.prepare('SELECT * FROM launch_index_states WHERE identity=?').get(identityKey(identity));
        if(!current||current.invalidated||current.next_block!==fromBlock||toBlock<fromBlock)conflict();
        const find=db.prepare('SELECT block_number,block_hash,created_at,args_json FROM launch_index_events WHERE identity=? AND transaction_hash=? AND log_index=?');
        const insert=db.prepare('INSERT INTO launch_index_events(identity,transaction_hash,log_index,block_number,block_hash,created_at,token,curve,deployer,pair_token,args_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
        for(const event of events){
          const args=JSON.stringify(event.args),old=find.get(identity.id,event.transactionHash,event.logIndex);
          if(old){
            if(old.block_number!==event.blockNumber||old.block_hash!==event.blockHash||old.created_at!==event.createdAt||old.args_json!==args)throw new Error('Conflicting launch events were returned for one transaction log.');
            continue;
          }
          insert.run(identity.id,event.transactionHash,event.logIndex,event.blockNumber,event.blockHash,event.createdAt,event.args.token,event.args.curve,event.args.deployer,event.args.pairToken,args);
        }
        db.prepare('INSERT INTO launch_index_ranges(identity,from_block,to_block,end_hash,checked_at) VALUES(?,?,?,?,?)').run(identity.id,fromBlock,toBlock,endHash,at);
        db.prepare('UPDATE launch_index_states SET next_block=?,target_block=?,last_success_at=?,last_attempt_at=?,verified_at=?,error=NULL WHERE identity=?').run(toBlock+1,targetBlock,at,at,at,identity.id);
      },true);
    },
    verified(identity,{targetBlock,at}){
      return access(db=>db.prepare('UPDATE launch_index_states SET target_block=?,last_attempt_at=?,verified_at=?,error=NULL,invalidated=0 WHERE identity=?').run(targetBlock,at,at,identityKey(identity)));
    },
    failure(identity,{targetBlock,at,error}){
      return access(db=>db.prepare('UPDATE launch_index_states SET target_block=COALESCE(?,target_block),last_attempt_at=?,error=? WHERE identity=?').run(targetBlock??null,at,error,identityKey(identity)));
    },
    invalidate(identity,{at}){
      return access(db=>{
        const current=db.prepare('SELECT bootstrap_from FROM launch_index_states WHERE identity=?').get(identity.id);
        if(!current)conflict();
        db.prepare('UPDATE launch_index_states SET invalidated=1,verified_at=NULL,last_attempt_at=?,reorg_json=? WHERE identity=?')
          .run(at,JSON.stringify({kind:'reset',fromBlock:String(current.bootstrap_from),detectedAt:at}),identity.id);
      },true);
    },
    rollback(identity,{nextBlock,at,kind='rollback'}){
      return access(db=>{
        const current=db.prepare('SELECT * FROM launch_index_states WHERE identity=?').get(identityKey(identity));
        if(!current||nextBlock<current.bootstrap_from||nextBlock>current.next_block)conflict();
        db.prepare('DELETE FROM launch_index_events WHERE identity=? AND block_number>=?').run(identity.id,nextBlock);
        db.prepare('DELETE FROM launch_index_ranges WHERE identity=? AND to_block>=?').run(identity.id,nextBlock);
        db.prepare('UPDATE launch_index_states SET next_block=?,verified_at=NULL,error=NULL,invalidated=0,last_attempt_at=?,reorg_json=? WHERE identity=?')
          .run(nextBlock,at,JSON.stringify({kind,fromBlock:String(nextBlock),detectedAt:at}),identity.id);
      },true);
    },
    reset(identity,{fromBlock,targetBlock,at}){
      return access(db=>{
        db.prepare('DELETE FROM launch_index_events WHERE identity=?').run(identity.id);
        db.prepare('DELETE FROM launch_index_ranges WHERE identity=?').run(identity.id);
        db.prepare('UPDATE launch_index_states SET bootstrap_from=?,next_block=?,target_block=?,last_success_at=NULL,verified_at=NULL,error=NULL,invalidated=0,last_attempt_at=?,reorg_json=? WHERE identity=?')
          .run(fromBlock,fromBlock,targetBlock,at,JSON.stringify({kind:'reset',fromBlock:String(fromBlock),detectedAt:at}),identity.id);
      },true);
    },
  };
}
