export const STUDENT_PREVIEW_COOKIE = "onhsk_student_preview";

/** Admin đang bật chế độ xem/học như học viên */
export function effectiveAdmin(isAdmin: boolean, studentPreview: boolean): boolean {
  return isAdmin && !studentPreview;
}

export async function readStudentPreviewCookie(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  return (await cookies()).get(STUDENT_PREVIEW_COOKIE)?.value === "1";
}
