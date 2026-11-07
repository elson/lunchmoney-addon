import React from "react";

// Minimal passthrough stubs for @wealthfolio/ui

export const Button = ({
  children,
  onClick,
  disabled,
  variant: _v,
  size: _s,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  size?: string;
}) => (
  <button onClick={onClick} disabled={disabled} {...rest}>
    {children}
  </button>
);

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />;

export const Dialog = ({
  open,
  children,
  onOpenChange: _onOpenChange,
}: {
  open: boolean;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) => (open ? <div data-testid="dialog">{children}</div> : null);

export const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="dialog-content">{children}</div>
);

export const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="dialog-header">{children}</div>
);

export const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 data-testid="dialog-title">{children}</h2>
);

export const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="dialog-footer">{children}</div>
);

export const Page = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="page">{children}</div>
);

export const PageHeader = ({
  heading,
  text,
  actions,
}: {
  heading: string;
  text?: string;
  actions?: React.ReactNode;
}) => (
  <div data-testid="page-header">
    <h1>{heading}</h1>
    {text && <p>{text}</p>}
    {actions && <div data-testid="page-header-actions">{actions}</div>}
  </div>
);

export const PageContent = ({
  children,
  withPadding: _wp,
}: {
  children: React.ReactNode;
  withPadding?: boolean;
}) => <div data-testid="page-content">{children}</div>;

type DivProps = React.HTMLAttributes<HTMLDivElement> & { variant?: string };
export const Empty = ({ variant: _v, ...p }: DivProps) => <div data-testid="empty" {...p} />;
export const EmptyHeader = ({ variant: _v, ...p }: DivProps) => <div {...p} />;
export const EmptyMedia = ({ variant: _v, ...p }: DivProps) => <div {...p} />;
export const EmptyTitle = ({ variant: _v, ...p }: DivProps) => <h3 {...p} />;
export const EmptyDescription = (p: React.HTMLAttributes<HTMLParagraphElement>) => <p {...p} />;
export const EmptyContent = ({ variant: _v, ...p }: DivProps) => <div {...p} />;

export const Separator = () => <hr />;

export const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor}>{children}</label>
);

// Mirrors Base UI's ToggleGroup (@wealthfolio/ui ≥ 3.10): values are arrays,
// onValueChange receives the new pressed set, and pressed items get aria-pressed.
const ToggleGroupContext = React.createContext<{
  value: readonly string[];
  onValueChange?: (val: string[]) => void;
}>({ value: [] });

export const ToggleGroup = ({
  children,
  onValueChange,
  value = [],
  ...rest
}: {
  children: React.ReactNode;
  onValueChange?: (val: string[]) => void;
  value?: readonly string[];
} & Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue">) => (
  <ToggleGroupContext.Provider value={{ value, onValueChange }}>
    <div {...rest}>{children}</div>
  </ToggleGroupContext.Provider>
);

export const ToggleGroupItem = ({
  children,
  value,
  ...rest
}: {
  children: React.ReactNode;
  value: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const group = React.useContext(ToggleGroupContext);
  const pressed = group.value.includes(value);
  return (
    <button
      value={value}
      aria-pressed={pressed}
      onClick={() => group.onValueChange?.(pressed ? [] : [value])}
      {...rest}
    >
      {children}
    </button>
  );
};

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="dropdown-menu">{children}</div>
);

// Base UI triggers take `render` (an element to render as) instead of Radix's `asChild`.
export const DropdownMenuTrigger = ({
  children,
  render,
}: {
  children?: React.ReactNode;
  render?: React.ReactElement<{ children?: React.ReactNode }>;
}) => (
  <div data-testid="dropdown-trigger">
    {render ? React.cloneElement(render, undefined, children) : children}
  </div>
);

export const DropdownMenuContent = ({
  children,
  align: _align,
}: {
  children: React.ReactNode;
  align?: string;
}) => <div data-testid="dropdown-content">{children}</div>;

export const DropdownMenuItem = ({
  children,
  ...rest
}: {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <div role="menuitem" {...rest}>
    {children}
  </div>
);

export const DropdownMenuSeparator = () => <hr data-testid="dropdown-separator" />;

export const Icons = {
  ArrowLeft: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-arrow-left" />
  ),
  RefreshCw: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-refresh-cw" />
  ),
  Eye: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-eye" />
  ),
  EyeOff: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-eye-off" />
  ),
  Link: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-link" />
  ),
  Plus: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-plus" />
  ),
  Check: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-check" />
  ),
  Trash: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-trash" />
  ),
  ShieldCheck: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-shield-check" />
  ),
  AlertCircle: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-alert-circle" />
  ),
  Building: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-building" />
  ),
  Wallet: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-wallet" />
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-external-link" />
  ),
  Search: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-search" />
  ),
  Close: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-close" />
  ),
  Refresh: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-refresh" />
  ),
  Settings: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-settings" />
  ),
  Import: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-import" />
  ),
  Spinner: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-spinner" />
  ),
  Loader: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-loader" />
  ),
  ArrowRight: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-arrow-right" />
  ),
  CheckCircle: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-check-circle" />
  ),
  Circle: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-circle" />
  ),
  AlertTriangle: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-alert-triangle" />
  ),
  ChevronsUpDown: ({ className }: { className?: string }) => (
    <span className={className} data-testid="icon-chevrons-up-down" />
  ),
};

export const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// ─── Card / Badge / Alert: layout-only passthroughs ──────────────────────────
type Div = React.HTMLAttributes<HTMLDivElement> & { variant?: string };
const passDiv =
  (testId?: string) =>
  ({ variant: _v, ...p }: Div) => <div data-testid={testId} {...p} />;
export const Card = passDiv("card");
export const CardHeader = passDiv();
export const CardContent = passDiv();
export const CardFooter = passDiv();
export const CardAction = passDiv();
// Real CardTitle renders a <div>, not a heading.
export const CardTitle = passDiv();
export const CardDescription = ({ variant: _v, ...p }: Div) => <p {...p} />;
export const Alert = ({ variant: _v, ...p }: Div) => <div role="alert" {...p} />;
export const AlertTitle = passDiv();
export const AlertDescription = passDiv();
export const Badge = ({
  variant: _v,
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => <span {...p} />;

// Base UI Progress: value 0–100.
export const Progress = ({ value, ...p }: { value?: number | null } & Div) => (
  <div role="progressbar" aria-valuenow={value ?? undefined} {...p} />
);

// Base UI Checkbox: checked + onCheckedChange(checked).
export const Checkbox = ({
  checked,
  onCheckedChange,
  id,
  ...p
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked">) => (
  <input
    type="checkbox"
    id={id}
    checked={checked}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    {...p}
  />
);

// Controlled AlertDialog: renders its content only while open.
const AlertDialogContext = React.createContext<{
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}>({ open: false });
export const AlertDialog = ({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => (
  <AlertDialogContext.Provider value={{ open, onOpenChange }}>
    {children}
  </AlertDialogContext.Provider>
);
export const AlertDialogContent = ({ children }: { children: React.ReactNode }) => {
  const { open } = React.useContext(AlertDialogContext);
  return open ? <div role="alertdialog">{children}</div> : null;
};
export const AlertDialogHeader = passDiv();
export const AlertDialogFooter = passDiv();
export const AlertDialogTitle = ({ variant: _v, ...p }: Div) => <h2 {...p} />;
export const AlertDialogDescription = ({ variant: _v, ...p }: Div) => <p {...p} />;
export const AlertDialogCancel = ({
  variant: _v,
  size: _s,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
  const { onOpenChange } = React.useContext(AlertDialogContext);
  return <button type="button" onClick={() => onOpenChange?.(false)} {...p} />;
};
export const AlertDialogAction = ({
  variant: _v,
  size: _s,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
  <button type="button" {...p} />
);
