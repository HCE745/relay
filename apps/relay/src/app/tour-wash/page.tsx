import { redirect } from "next/navigation"

export default function TourWashPage() {
  redirect("/tour?industry=car-wash")
}
