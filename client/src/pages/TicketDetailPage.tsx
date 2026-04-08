import { useParams, Link } from "react-router-dom";
import { TicketDetail } from "@/components/TicketDetail";
import { TicketReplies } from "@/components/TicketReplies";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
        <Link
          to="/tickets"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Tickets
        </Link>

        <div className="space-y-8">
          <TicketDetail ticketId={id ?? ""} />
          <TicketReplies ticketId={id ?? ""} />
        </div>
    </div>
  );
}

export default TicketDetailPage;
