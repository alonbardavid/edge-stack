import { useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, Box, Paper, Stack, Text, Title } from "@mantine/core";
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
import { signUp } from "../../logic/authentication/client";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export const SignUpScreen = () => {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const form = useForm({
    initialValues: { name: "", email: "", password: "" },
    schema,
    validateInputOnBlur: true,
  });

  const handleSubmit = async (values: typeof form.values) => {
    const { error } = await signUp.email({
      name: String(values.name),
      email: String(values.email),
      password: String(values.password),
      callbackURL: "/",
    });
    if (error) {
      form.setFieldError(GENERAL_ERROR_KEY, error.message ?? "Sign up failed");
      return;
    }
    setPendingEmail(String(values.email));
  };

  return (
    <Box style={centeredBox}>
      <Paper withBorder shadow="xs" radius="md" p="xl" w="100%" maw={380}>
        {pendingEmail ? (
          <CheckInboxMessage email={pendingEmail} />
        ) : (
          <StandardForm form={form} onSubmit={handleSubmit}>
            <Stack gap="md">
              <Title order={2} ta="center">
                Create your account
              </Title>
              <FormTextInput
                name="name"
                label="Name"
                placeholder="Ada Lovelace"
                autoFocus
              />
              <FormTextInput
                name="email"
                label="Email"
                type="email"
                placeholder="you@example.com"
              />
              <FormPasswordInput
                name="password"
                label="Password"
                placeholder="At least 8 characters"
              />
              <FormGeneralErrors />
              <FormSubmitButton>Sign up</FormSubmitButton>
              <Text ta="center" size="sm" c="dimmed">
                Already have an account?{" "}
                <Anchor component={Link} to="/">
                  Sign in
                </Anchor>
              </Text>
            </Stack>
          </StandardForm>
        )}
      </Paper>
    </Box>
  );
};

const CheckInboxMessage = ({ email }: { email: string }) => {
  return (
    <Stack gap="md" ta="center">
      <Title order={2}>Check your inbox</Title>
      <Text c="dimmed">
        We sent a verification link to <strong>{email}</strong>. Click it to
        activate your account and finish signing in.
      </Text>
      <Anchor component={Link} to="/">
        Back to sign in
      </Anchor>
    </Stack>
  );
};

const centeredBox = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
};
