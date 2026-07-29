export type DialogTone = 'neutral' | 'warning' | 'danger' | 'success';

export interface DialogAction {
  id: string;
  label: string;
  kind?: 'secondary' | 'primary' | 'danger';
}

export interface ChoiceDialogOptions {
  title: string;
  message: string;
  detail?: string;
  tone?: DialogTone;
  icon?: string;
  actions: DialogAction[];
}

export interface PromptDialogOptions {
  title: string;
  message: string;
  detail?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  password?: boolean;
  required?: boolean;
  confirmLabel?: string;
  tone?: DialogTone;
  icon?: string;
}

export interface UserInteraction {
  choose(options: ChoiceDialogOptions): Promise<string | undefined>;
  prompt(options: PromptDialogOptions): Promise<string | undefined>;
  notify(message: string, tone?: DialogTone): void;
}
