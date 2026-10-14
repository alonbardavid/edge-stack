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
import { signIn } from "../../logic/authentication/client";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const LoginScreen = () => {
  const form = useForm({
    initialValues: { email: "", password: "" },
    schema,
    validateInputOnBlur: true,
  });

  const handleSubmit = async (values: typeof form.values) => {
    const { error } = await signIn.email({
      email: String(values.email),
      password: String(values.password),
    });
    if (error) {
      form.setFieldError(GENERAL_ERROR_KEY, error.message ?? "Login failed");
    }
  };

  return (
    <Box style={centeredBox}>
      <Paper withBorder shadow="xs" radius="md" p="xl" w="100%" maw={380}>
        <StandardForm form={form} onSubmit={handleSubmit}>
          <Stack gap="md">
            <Title order={2} ta="center">
              Sign in
            </Title>
            <FormTextInput
              name="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
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
