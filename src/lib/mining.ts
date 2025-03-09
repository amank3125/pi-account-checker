import { saveMiningDataSupabase } from "./supabase";

// Function to update expired mining status in database
export async function updateExpiredMiningStatusInDB(
  phoneNumbers: string[],
  miningStatus: Record<
    string,
    {
      isActive: boolean;
      expiresAt: string | null;
      hourlyRatio: number | null;
      teamCount: number | null;
      miningCount: number | null;
      completedSessions: number | null;
    }
  >
) {
  if (phoneNumbers.length === 0) return 0;

  try {
    console.log(
      `Updating expired mining status for ${phoneNumbers.length} accounts in database...`
    );
    let successCount = 0;

    // For each expired account, update the database
    for (const phoneNumber of phoneNumbers) {
      // Get the current status
      const status = miningStatus[phoneNumber];
      if (!status) continue;

      try {
        // Create proper mining data object for Supabase
        const miningDataUpdate = {
          is_active: false, // Explicitly set to false for expired sessions
          // Keep other fields from the current status
          hourly_ratio: status.hourlyRatio,
          team_count: status.teamCount,
          mining_count: status.miningCount,
          completed_sessions_count: status.completedSessions,
          // Set valid_until to null to indicate expiration
          valid_until: null,
        };

        // Save to Supabase with correct parameters
        await saveMiningDataSupabase(phoneNumber, miningDataUpdate);
        successCount++;
        console.log(
          `Updated database for ${phoneNumber}: mining status set to inactive`
        );
      } catch (err) {
        console.error(
          `Failed to update mining status for ${phoneNumber}:`,
          err
        );
      }
    }

    return successCount;
  } catch (error) {
    console.error("Error updating expired mining status in database:", error);
    throw error;
  }
}
