import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import type { TrackingSetting } from "@lib/admin-contract";
import { orpc } from "../../logic/api/orpc";
import { errorMessage } from "../../logic/api/errorMessage";

export type UserLifecycle = ReturnType<typeof useUserLifecycle>;

export function useUserLifecycle(userId: string) {
  const queryClient = useQueryClient();
  const setTracking = useMutation(orpc.setUserTracking.mutationOptions());
  const remove = useMutation(orpc.deleteUser.mutationOptions());
  const restore = useMutation(orpc.restoreUser.mutationOptions());
  const nuke = useMutation(orpc.nukeUser.mutationOptions());
  const input = { id: userId };

  const run = async (
    action: () => Promise<unknown>,
    done: string,
    failed: string,
  ) => {
    try {
      await action();
      notifications.show({ message: done });
      await queryClient.invalidateQueries({ queryKey: orpc.listUsers.key() });
    } catch (error) {
      notifications.show({
        color: "red",
        message: errorMessage(error, failed),
      });
    }
  };

  return {
    setTracking: (tracking: TrackingSetting) =>
      run(
        () => setTracking.mutateAsync({ ...input, tracking }),
        `Tracking set to ${tracking}`,
        "Could not change tracking",
      ),
    remove: () =>
      run(
        () => remove.mutateAsync(input),
        "User deleted",
        "Could not delete user",
      ),
    restore: () =>
      run(
        () => restore.mutateAsync(input),
        "User restored",
        "Could not restore user",
      ),
    nuke: () =>
      run(() => nuke.mutateAsync(input), "User nuked", "Could not nuke user"),
    isPending:
      setTracking.isPending ||
      remove.isPending ||
      restore.isPending ||
      nuke.isPending,
  };
}
