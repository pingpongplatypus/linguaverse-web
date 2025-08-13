// app/page.tsx
// This is typically a Server Component by default in Next.js App Router
import AuthComponent from './auth'; // Import your authentication component

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '50px auto', padding: '20px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>Welcome to LinguaVerse!</h1>
      <p style={{ textAlign: 'center', fontSize: '1.1em', color: '#555' }}>
        Your journey to mastering new languages starts here.
      </p>

      {/* Render your authentication component here */}
      <AuthComponent />

      <section style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
        <h2 style={{ color: '#333' }}>What is LinguaVerse?</h2>
        <p style={{ lineHeight: '1.6' }}>
          LinguaVerse is designed to make language learning engaging and effective. 
          Whether you&apos;re a beginner or looking to perfect your fluency, our interactive {/* FIX: Changed 'you're' to 'you&apos;re' */}
          lessons and personalized exercises will guide you every step of the way.
        </p>
        <p style={{ lineHeight: '1.6' }}>
          Sign up or log in above to access your personalized dashboard and begin your linguistic adventure!
        </p>
      </section>
    </main>
  );
}
