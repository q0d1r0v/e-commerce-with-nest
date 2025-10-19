export interface RegisterTokenPayload {
  phoneNumber: string;
  purpose: 'register';
  iat?: number;
  exp?: number;
}
