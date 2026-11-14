export type GoalDetails={title:string;description:string;target:number;deadline:string|null};
export type Goal={id:string;details:GoalDetails;published:GoalDetails|null;revision:number;status:'open'|'completed';accepted:number;pending:number;createdAt:string;recap?:string;sharedRecap?:string|null;lockedDetails?:GoalDetails};
export type Contribution={id:string;goalId:string;wallet:string;revision:number;status:'pending'|'accepted'|'declined'|'withdrawn';note:string;url:string;alias:string;share:boolean;submittedAt:string;reviewNote?:string;reviewedAt?:string};
export type GrowthState={goals:Goal[];submissions:Contribution[]};
export type PublicGoal=GoalDetails&{id:string;status:'open'|'completed';accepted:number;recap:string|null;publishedAt:string;completedAt:string|null;mySubmission:Omit<Contribution,'wallet'|'goalId'>|null;contributions:{id:string;alias:string;note:string;url:string;reviewedAt:string}[]};
export type PublicGrowth={goals:PublicGoal[];scoreboard:{alias:string;points:number}[]};
export type ContentPlan={id:string;revision:number;title:string;body:string;channel:'x'|'project'|'discord'|'telegram';scheduledAt:string;status:'planned'|'done'|'cancelled';outcome?:string;completedAt?:string};
