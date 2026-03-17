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

export const EmptyPlaceholder = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="empty-placeholder">{children}</div>
);
EmptyPlaceholder.Icon = ({ name }: { name: string }) => (
  <span data-testid="empty-placeholder-icon">{name}</span>
);
EmptyPlaceholder.Title = ({ children }: { children: React.ReactNode }) => (
  <h3 data-testid="empty-placeholder-title">{children}</h3>
);
EmptyPlaceholder.Description = ({ children }: { children: React.ReactNode }) => (
  <p data-testid="empty-placeholder-description">{children}</p>
);

export const Separator = () => <hr />;

export const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor}>{children}</label>
);

const ToggleGroupContext = React.createContext<((val: string) => void) | undefined>(undefined);

export const ToggleGroup = ({
  children,
  onValueChange,
  value: _v,
  type: _t,
  ...rest
}: {
  children: React.ReactNode;
  onValueChange?: (val: string) => void;
  value?: string;
  type?: string;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <ToggleGroupContext.Provider value={onValueChange}>
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
  const onValueChange = React.useContext(ToggleGroupContext);
  return (
    <button value={value} onClick={() => onValueChange?.(value)} {...rest}>
      {children}
    </button>
  );
};

export const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="dropdown-menu">{children}</div>
);

export const DropdownMenuTrigger = ({
  children,
  asChild: _asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => <div data-testid="dropdown-trigger">{children}</div>;

export const DropdownMenuContent = ({
  children,
  align: _align,
}: {
  children: React.ReactNode;
  align?: string;
}) => <div data-testid="dropdown-content">{children}</div>;

export const DropdownMenuItem = ({
  children,
  onSelect,
  ...rest
}: {
  children: React.ReactNode;
  onSelect?: () => void;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <div role="menuitem" onClick={onSelect} {...rest}>
    {children}
  </div>
);

export const DropdownMenuSeparator = () => <hr data-testid="dropdown-separator" />;

export const Icons = {
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
