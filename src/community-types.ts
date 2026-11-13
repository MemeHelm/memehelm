export type CommunityLinks={website:string;x:string;telegram:string;discord:string};
export type EventDetails={title:string;description:string;startsAt:string;endsAt:string;url:string;capacity:number|null};
export type CommunityEvent={id:string;revision:number;details:EventDetails;publishedDetails:EventDetails|null;publishedRevision?:number;status:'upcoming'|'cancelled'|'completed';going:number;attended:number;outcome?:string;cancellation?:string};
export type PublicEvent=EventDetails&{id:string;status:CommunityEvent['status'];going:number;attending:boolean;recap:string|null;cancellation:string|null};
export type PublicCommunityData={links:Partial<CommunityLinks>;events:PublicEvent[]};
export type XPost={id:string;text:string;revision:number;status:'draft'|'approved'|'sending'|'published'|'uncertain'|'failed';createdAt:string;error?:string;receipt?:{url:string;username:string};metrics?:{like_count:number;reply_count:number;retweet_count:number;quote_count:number;checkedAt:string}};
export type SocialState={available:boolean;account:{id:string;username:string;name:string}|null;posts:XPost[]};
export type CommunityState={revision:number;links:CommunityLinks;sharedLinks:CommunityLinks|null;events:CommunityEvent[];social:SocialState;drafts:{id:string;title:string;content:string}[]};
