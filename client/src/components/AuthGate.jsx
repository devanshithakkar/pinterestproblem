import { LogIn, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function AuthGate({ authError }) {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  return (
    <main className="grid min-h-screen place-items-center overflow-hidden px-5 py-10">
      <section className="glass-panel max-w-xl p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ember text-white shadow-lift">
          <Sparkles className="h-7 w-7" />
        </div>
        <p className="text-xs font-black uppercase text-ember">Private AI boards</p>
        <h1 className="mt-2 text-4xl font-black">Sign in to PinMind</h1>
        <p className="mt-4 text-base font-semibold leading-7 text-black/55">
          Continue with Google to keep your boards, saved pins, AI decisions, and uploaded images private to your account.
        </p>
        {authError ? <div className="mt-5 rounded-2xl bg-blush px-4 py-3 text-sm font-bold text-ember">{authError}</div> : null}
        <button
          onClick={signInWithGoogle}
          className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 py-4 font-black text-white shadow-lift transition hover:-translate-y-0.5 sm:w-auto"
        >
          <LogIn className="h-5 w-5" />
          Continue with Google
        </button>
      </section>
    </main>
  );
}
