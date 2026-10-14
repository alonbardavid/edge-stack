import { getDb, trackingSettings, inArray, newEntityId } from "@lib/db-models";
import { TRACKING_SETTINGS, type TrackingSetting } from "@lib/contract";
import { moduleLogger } from "@lib/logging";

const log = moduleLogger("analytics-server/tracking");

export interface TrackingSettingChange {
  userId: string;
  tracking: TrackingSetting;
  /** The user's own id, or the admin's who made the change for them. */
  updatedBy: string;
}

export async function loadTrackingSetting(
  userId: string,
): Promise<TrackingSetting | null> {
  const settings = await loadTrackingSettings([userId]);
  return settings.get(userId) ?? null;
}

export async function loadTrackingSettings(
  userIds: string[],
): Promise<Map<string, TrackingSetting>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const rows = await getDb()
    .select({
      userId: trackingSettings.userId,
      tracking: trackingSettings.tracking,
    })
    .from(trackingSettings)
    .where(inArray(trackingSettings.userId, userIds));
  return new Map(
    rows.flatMap((row) => {
      const tracking = asTrackingSetting(row.tracking);
      return tracking ? [[row.userId, tracking] as const] : [];
    }),
  );
}

/** The users none of whose events may be sent, whoever raised them. */
export async function loadSuppressedUserIds(
  userIds: string[],
): Promise<Set<string>> {
  const settings = await loadTrackingSettings(userIds);
  return new Set(
    [...settings.entries()]
      .filter(([, tracking]) => tracking === "disabled")
      .map(([userId]) => userId),
  );
}

export async function setTrackingSetting(
  change: TrackingSettingChange,
): Promise<void> {
  await getDb()
    .insert(trackingSettings)
    .values({
      id: newEntityId("TRACKING_SETTING"),
      userId: change.userId,
      tracking: change.tracking,
      updatedBy: change.updatedBy,
    })
    .onConflictDoUpdate({
      target: trackingSettings.userId,
      set: {
        tracking: change.tracking,
        updatedBy: change.updatedBy,
        updatedAt: new Date(),
      },
    });
  log.info("tracking setting changed", {
    userId: change.userId,
    tracking: change.tracking,
    updatedBy: change.updatedBy,
  });
}

export function asTrackingSetting(
  value: string | null,
): TrackingSetting | null {
  return TRACKING_SETTINGS.includes(value as TrackingSetting)
    ? (value as TrackingSetting)
    : null;
}
