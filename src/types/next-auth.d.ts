import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isPremium: boolean;
      canEditContent: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isPremium: boolean;
    canEditContent: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    isPremium?: boolean;
    canEditContent?: boolean;
  }
}
