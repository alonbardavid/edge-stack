import { useState } from "react";
import { Button, Group, Stack, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import {
  FormGeneralErrors,
  FormPasswordInput,
  FormSubmitButton,
  GENERAL_ERROR_KEY,
  StandardForm,
  useForm,
} from "@lib/ds";
import { orpc } from "../../logic/api/orpc";
import { errorMessage } from "../../logic/api/errorMessage";
import type { ManagedUser } from "./types";

const schema = z.object({
  newPassword: z.string().min(8, "At least 8 characters"),
});

export const UserRow = ({ user }: { user: ManagedUser }) => {
  const [editing, setEditing] = useState(false);

  return (
    <Table.Tr>
      <Table.Td>{user.name}</Table.Td>
      <Table.Td>{user.email}</Table.Td>
      <Table.Td>
        <Stack gap="xs">
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setEditing((open) => !open)}
            >
              {editing ? "Cancel" : "Set password"}
            </Button>
          </Group>
          {editing && (
            <SetPasswordForm
              userId={user.id}
              onDone={() => setEditing(false)}
            />
          )}
        </Stack>
      </Table.Td>
    </Table.Tr>
  );
};

const SetPasswordForm = ({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) => {
  const setUserPassword = useMutation(orpc.setUserPassword.mutationOptions());
  const form = useForm({
    initialValues: { newPassword: "" },
    schema,
    validateInputOnBlur: true,
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await setUserPassword.mutateAsync({
        id: userId,
        newPassword: String(values.newPassword),
      });
      notifications.show({ message: "Password updated" });
      onDone();
    } catch (error) {
      form.setFieldError(
        GENERAL_ERROR_KEY,
        errorMessage(error, "Could not update password"),
      );
    }
  };

  return (
    <StandardForm form={form} onSubmit={handleSubmit}>
      <Stack gap="xs">
        <FormPasswordInput
          name="newPassword"
          label="New password"
          placeholder="At least 8 characters"
        />
        <FormGeneralErrors />
        <Group justify="flex-end">
          <FormSubmitButton size="xs">Save</FormSubmitButton>
        </Group>
        <Text size="xs" c="dimmed">
          The user can sign in with the new password immediately.
        </Text>
      </Stack>
    </StandardForm>
  );
};
