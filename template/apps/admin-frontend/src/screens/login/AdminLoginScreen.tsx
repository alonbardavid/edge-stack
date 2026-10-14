import { Box, Paper, Stack, Title } from "@mantine/core";
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
import { adminLogin } from "../../logic/auth/session";
import { useAdminMe } from "../../logic/auth/useAdminMe";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const AdminLoginScreen = () => {
  const { refresh } = useAdminMe();
  const form = useForm({
    initialValues: { username: "", password: "" },
    schema,
    validateInputOnBlur: true,
  });

  const handleSubmit = async (values: typeof form.values) => {
    const result = await adminLogin(
      String(values.username),
      String(values.password),
    );
    if (!result.ok) {
      form.setFieldError(GENERAL_ERROR_KEY, result.message ?? "Login failed");
      return;
    }
    await refresh();
  };

  return (
    <Box style={centeredBox}>
      <Paper withBorder shadow="xs" radius="md" p="xl" w="100%" maw={380}>
        <StandardForm form={form} onSubmit={handleSubmit}>
          <Stack gap="md">
            <Title order={2} ta="center">
              Admin sign in
            </Title>
            <FormTextInput
              name="username"
              label="Username"
              placeholder="admin"
              autoFocus
            />
            <FormPasswordInput
              name="password"
              label="Password"
              placeholder="Your password"
            />
            <FormGeneralErrors />
            <FormSubmitButton>Sign in</FormSubmitButton>
          </Stack>
        </StandardForm>
      </Paper>
    </Box>
  );
};

const centeredBox = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
};
