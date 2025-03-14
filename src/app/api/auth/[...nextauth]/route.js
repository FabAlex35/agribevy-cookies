
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        // Example user fetched from a database
        const user = { id: 1, name: "John Doe", email: "john@example.com", role: "admin" };
        if (user) {
          return user;
        } else {
          throw new Error("Invalid credentials");
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Add role to the session
      session.user.role = token.role;
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
  },
});

export { handler as GET, handler as POST };
