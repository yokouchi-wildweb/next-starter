export type NavLinkItem = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
};

export type NavActionItem = {
  readonly key: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
};

export type NavDummyItem = {
  readonly key: string;
  readonly label: string;
};

export type NavItem =
  | (NavLinkItem & { readonly type: "link" })
  | (NavActionItem & { readonly type: "action" })

