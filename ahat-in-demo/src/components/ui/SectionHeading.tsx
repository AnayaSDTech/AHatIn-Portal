import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Reveal } from './Reveal';

interface Props {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  light?: boolean;
}

export function SectionHeading({ eyebrow, title, description, align = 'center', light }: Props) {
  return (
    <Reveal className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      <span className={cn('eyebrow', light && 'text-gold-300')}>
        <span className="h-px w-8 bg-current" aria-hidden />
        {eyebrow}
      </span>
      <h2 className={cn('mt-4 text-3xl leading-tight sm:text-4xl lg:text-5xl', light && 'text-white')}>{title}</h2>
      {description && (
        <p className={cn('mt-5 text-base leading-relaxed sm:text-lg', light ? 'text-navy-100' : 'text-navy-600')}>
          {description}
        </p>
      )}
    </Reveal>
  );
}
