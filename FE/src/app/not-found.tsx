import Link from "next/link"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { t } from "@/lib/i18n"

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        icon={Compass}
        title={t.common.notFoundTitle}
        action={
          <Button asChild>
            <Link href="/">{t.common.goHome}</Link>
          </Button>
        }
      />
    </div>
  )
}
