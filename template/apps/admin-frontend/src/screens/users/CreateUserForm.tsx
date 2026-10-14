import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Paper, Stack, Title } from "@mantine/core";
import { z } from "zod";
import {
  FormGeneralErrors,
  FormPasswordInput,
  FormSubmitButton,
  FormTextInput,
  GENERAL_ERROR_KEY,
  StandardForm,
  useForm,
} from "@lib/ds";
import { orpc } from "../../logic/api/orpc";
import { errorMessage } from "../../logic/api/errorMessage";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export const CreateUserForm = () => {
  const queryClient = useQueryClient();
  const createUser = useMutation(orpc.createUser.mutationOptions());
  const form = useForm({
    initialValues: { name: "", email: "", password: "" },
    schema,
    validateInputOnBlur: true,
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      const created = await createUser.mutateAsync({
        name: String(values.name),
        email: String(values.email),
        password: String(values.password),
      });
      notifications.show({ message: `Created user ${created.email}` });
      form.reset();
      await queryClient.invalidateQueries({ queryKey: orpc.listUsers.key() });
    } catch (error) {
      form.setFieldError(
        GENERAL_ERROR_KEY,
        errorMessage(error, "Could not create user"),
      );
    }
  };

  return (
    <Paper withBorder shadow="xs" radius="md" p="lg">
      <StandardForm form={form} onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Title order={4}>Create user</Title>
          <FormTextInput name="name" label="Name" placeholder="Jane Doe" />
          <FormTextInput
            name="email"
            label="Email"
            type="email"
            placeholder="jane@example.com"
          />
          <FormPasswordInput
            name="password"
            label="Password"
            placeholder="At least 8 characters"
          />
          <FormGeneralErrors />
          <FormSubmitButton>Create user</FormSubmitButton>
        </Stack>
      </StandardForm>
    </Paper>
  );
};
