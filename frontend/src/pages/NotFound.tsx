import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center space-y-4 text-center">
      <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">404</h1>
      <h2 className="text-xl font-medium sm:text-2xl md:text-3xl">Page Not Found</h2>
      <p className="max-w-[600px] text-muted-foreground md:text-xl">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/">Go back home</Link>
      </Button>
    </div>
  );
}
