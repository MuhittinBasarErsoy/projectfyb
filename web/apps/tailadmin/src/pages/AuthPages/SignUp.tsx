import SignUpForm from "@/components/auth/SignUpForm";
import PageMeta from "@/components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";

export default function SignUp() {
  return (
    <>
      <PageMeta title="Kayıt · FyBlue" description="FyBlue hesabı oluşturun." />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
