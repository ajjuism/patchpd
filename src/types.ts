export interface PdPatch {
  name: string;
  content: string;
  explanation: string;
  description: string;
  created: Date;
  version: string;
  metadata: {
    width: number;
    height: number;
    audioEnabled: boolean;
    controlRate: boolean;
    requiredObjects: string[];
    audioChain: {
      hasStartToggle: boolean;
      hasDac: boolean;
      hasVolumeControl: boolean;
      hasVuMeter: boolean;
      hasInstructions: boolean;
    };
  };
  errorHistory?: Array<{
    error: string;
    timestamp: Date;
    regeneratedPatch?: {
      content: string;
      explanation: string;
      timestamp: Date;
    };
  }>;
}

export interface GenerateResponse {
  patch: string;
  explanation: string;
}