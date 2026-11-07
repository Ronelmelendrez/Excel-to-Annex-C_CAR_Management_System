/**
 * Page gutter shared by the app header, the main content area and the footer.
 * Every region of the shell lines up on the same 1180px measure and the same
 * horizontal padding, so the chrome reads as one column.
 *
 * `w-full` matters for `main`: as a flex item in the shell's column it must
 * declare its cross size explicitly, otherwise `mx-auto` stops the stretch and
 * the column would collapse to its content width instead of 1180px.
 */
export const shellContainer = 'mx-auto w-full max-w-[1180px] px-4 sm:px-6';
