export interface Spec {
  objective: string;
  requirements: string[];
  acceptance: string[];
  clarifications: string[];
}

export interface PlannedTask {
  id: string;
  role: string;
  tier: string;
  deps: string[];
  instruction: string;
  verify?: string[];
}

export interface Plan {
  spec: Spec;
  approach: string;
  tasks: PlannedTask[];
}