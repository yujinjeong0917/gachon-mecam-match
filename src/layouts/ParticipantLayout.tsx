import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { MobileFrame } from "../components/MobileFrame";
import { pageVariants } from "../motion";
import "./ParticipantLayout.css";

/** 참가자 화면 전체를 감싸는 레이아웃. 경로가 바뀔 때마다 Apple 스타일 커브로 교체된다. */
export function ParticipantLayout() {
  const location = useLocation();

  return (
    <div className="participant-layout">
      <MobileFrame>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="participant-layout__page"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </MobileFrame>
    </div>
  );
}
