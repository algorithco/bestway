import { cva, type VariantProps } from "class-variance-authority";

/**
 * Tugma uslublari — alohida (client bo'lmagan) modulda.
 * Shunda Server Component'lar ham `buttonVariants(...)` ni `<Link>`/`<a>` ga
 * to'g'ridan-to'g'ri qo'llay oladi (Radix Slot / asChild ishlatmasdan).
 */
export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 rounded-[8px] font-medium whitespace-nowrap transition-[transform,background-color,box-shadow,color,border-color] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Asosiy amal — sahifada bittadan ortiq bo'lmasin */
        primary:
          "bg-brand text-brand-fg shadow-sm shadow-brand/20 hover:bg-brand-hover hover:shadow-md hover:shadow-brand/25",
        /** Ikkilamchi — chegarali, fonsiz */
        outline: "border border-border bg-surface text-fg hover:bg-surface-hover hover:border-border-strong",
        /** Uchinchi darajali — faqat matn */
        ghost: "text-fg-muted hover:bg-surface-hover hover:text-fg",
        /** Buzuvchi amal (o'chirish) */
        danger: "bg-danger text-white shadow-sm shadow-danger/20 hover:opacity-90",
        /** Yumshoq brend — fon och yashil */
        subtle: "bg-brand-subtle text-brand-subtle-fg hover:opacity-80",
      },
      size: {
        // Mobilda touch uchun bir oz balandroq (kamida ~36–40px), sm dan boshlab zichroq
        sm: "h-9 px-3 text-sm sm:h-8 [&_svg]:size-4",
        md: "h-10 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-10 [&_svg]:size-4",
        "icon-sm": "size-10 sm:size-8 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
