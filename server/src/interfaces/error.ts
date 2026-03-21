export interface ApiError {
  message: string;
  status?: number;
  statusCode?: number;
  name?: string;
  code?: string;
  errors?: { path: (string | number)[]; message: string }[];
  stack?: string;
}
