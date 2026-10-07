// Shared by server and browser code.

// Students who haven't picked a major yet: no major requirements, just GEs and electives.
export const UNDECLARED_ID = "undeclared";
export const isUndeclared = (id: string) => id === UNDECLARED_ID;
