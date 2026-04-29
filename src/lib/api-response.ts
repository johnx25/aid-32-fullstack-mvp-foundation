import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PROFILE_INCOMPLETE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PROFILE_INCOMPLETE"
  | "INTERNAL_ERROR";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function fail(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ success: false, data: null, error: { code, message } }, { status });
}
