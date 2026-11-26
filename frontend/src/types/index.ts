export type Role='teacher'|'student';
export type User={id:string;name:string;email:string;role:Role};
export type Room={id:string;code:string;title:string;teacherId:string;status:'waiting'|'live'|'ended';createdAt:string;endedAt?:string};
export type Segment={id:string;roomId:string;text:string;authorId:string;kind:'speech'|'sign';createdAt:string};
export type RoomHistory={room:Room;segments:Segment[]};
