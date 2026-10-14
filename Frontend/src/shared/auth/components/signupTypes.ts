export interface SignupDraft {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  emergencyContactNumber: string;
  firstName: string;
  lastName: string;
  address: string;
  dateOfBirth: string;
}

export type SignupField = keyof SignupDraft;

export interface SignupFieldError {
  code: string;
  message: string;
}

export type SignupErrors = Partial<Record<SignupField, SignupFieldError[]>>;

export interface SignupAccountValidationRequest {
  step: 'account';
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface SignupProfileValidationRequest {
  step: 'profile';
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  emergencyContactNumber: string;
  firstName: string;
  lastName: string;
  address: string;
  dateOfBirth: string;
}

export type SignupValidationRequest =
  SignupAccountValidationRequest | SignupProfileValidationRequest;

export interface SignupValidationData {
  valid: boolean;
  fieldErrors: SignupErrors;
}
