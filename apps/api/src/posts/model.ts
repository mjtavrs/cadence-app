import type { Role } from "../auth/rbac";
import type { PostChannel } from "./channels";

export type PostStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type PostItem = {
  PK: string;
  SK: string;

  postId: string;
  workspaceId: string;

  title: string;
  shortCode: string;
  tags: string[];

  status: PostStatus;
  caption: string;
  mediaIds: string[];
  channels: PostChannel[];

  createdAt: string;
  createdByUserId: string;
  createdByRole: Role;

  updatedAt: string;
  publishedAt?: string;

  flaggedAt?: string;
  flaggedByUserId?: string;
  flaggedByLabel?: string;
  flagReason?: string;

  scheduledAtUtc?: string;
  weekBucket?: string;
  monthBucket?: string;

  // Indexes
  GSI2PK?: string;
  GSI2SK?: string;
  GSI3PK?: string;
  GSI3SK?: string;
  GSI4PK?: string;
  GSI4SK?: string;
};

