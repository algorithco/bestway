import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Til prefiksini avtomatik qo'shadigan Link/router — oddiy next/link o'rniga shulardan foydalaning */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
