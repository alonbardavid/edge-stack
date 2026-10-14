import {
  PasswordInput,
  type PasswordInputProps,
  TextInput,
  type TextInputProps,
} from "@mantine/core";
import { useFormContext } from "./context";

interface FormFieldProps {
  name: string;
}

export function FormTextInput({
  name,
  ...props
}: FormFieldProps & Omit<TextInputProps, "error">) {
  const form = useFormContext();
  return <TextInput {...props} {...form.getInputProps(name)} />;
}

export function FormPasswordInput({
  name,
  ...props
}: FormFieldProps & Omit<PasswordInputProps, "error">) {
  const form = useFormContext();
  return <PasswordInput {...props} {...form.getInputProps(name)} />;
}
