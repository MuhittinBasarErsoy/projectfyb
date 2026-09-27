import SignInForm from "@/components/auth/SignInForm";
import PageMeta from "@/components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";

export default function SignIn() {
  return (
    <>
      <PageMeta title="Giriş · FyBlue" description="FyBlue hesabınızla giriş yapın." />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
