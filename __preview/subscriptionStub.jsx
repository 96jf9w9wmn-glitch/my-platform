import { createContext } from "react"
export const SubscriptionCtx = createContext({})
export const fetchPlanState = () => Promise.resolve({})
export const useSubscription = () => ({ plan: "studio", status: "active", loading: false, known: true })
export const usePlan = () => ({ allows: () => true, plan: "studio", limits: {}, known: true })
export default usePlan
