import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../config/database';

type AuditInput = {
  req?: Request;
  action: string;
  entity: string;
  entityId?: string | number | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export async function auditLog({ req, action, entity, entityId, summary, metadata }: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req?.user?.id,
        userEmail: req?.user?.email,
        userRole: req?.user?.role as any,
        action,
        entity,
        entityId: entityId === undefined || entityId === null ? null : String(entityId),
        summary,
        metadata,
        ipAddress: req?.ip,
      },
    });
  } catch (error) {
    console.warn('Audit log failed:', error);
  }
}
