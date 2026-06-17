import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "danger" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

const classByVariant: Record<ButtonVariant, string> = {
  primary: "primary-button",
  ghost: "ghost-button",
  danger: "danger-button",
  icon: "icon-button",
};

export function Button({ variant = "ghost", icon, children, className = "", ...props }: ButtonProps) {
  return (
    <button className={`${classByVariant[variant]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}
