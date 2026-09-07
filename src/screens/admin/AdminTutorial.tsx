import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useState } from "react";
import "./AdminTutorial.css";

export type AdminTab = "개요" | "참가자 관리" | "접수 퍼널" | "매칭 실행" | "운영 대기열" | "행사 제어";

interface TutorialStep {
  tab: AdminTab;
  selector: string;
  direction: "top" | "bottom" | "left" | "right";
  message: string;
}

const STEPS: TutorialStep[] = [
  { tab: "개요", selector: '[data-tutorial="nav-개요"]', direction: "right", message: "전체 신청 현황이랑 확인 대기 중인 항목을 여기서 한눈에 볼 수 있어요." },
  { tab: "접수 퍼널", selector: '[data-tutorial="nav-접수 퍼널"]', direction: "right", message: "신청 과정 중 어느 단계에서 이탈이 많은지 확인할 수 있어요." },
  { tab: "매칭 실행", selector: '[data-tutorial="nav-매칭 실행"]', direction: "right", message: "실제 매칭은 여기서 진행해요. 다음 화면에서 순서대로 안내할게요." },
  { tab: "매칭 실행", selector: '[data-tutorial="export-buttons"]', direction: "bottom", message: "매칭을 확정하기 전에 먼저 '전체 참가자 내보내기'로 CSV를 받아두세요. 문제가 생겨도 수동으로 매칭할 수 있어요." },
  { tab: "매칭 실행", selector: '[data-tutorial="preview-button"]', direction: "top", message: "여기를 눌러 미리보기부터 확인하세요. 이 단계에서는 아직 아무것도 저장되지 않아요. 결과가 괜찮으면 그 아래 '확정하기'를 눌러요." },
  { tab: "운영 대기열", selector: '[data-tutorial="nav-운영 대기열"]', direction: "right", message: "매칭된 두 사람이 서로 인스타그램 팔로우를 했는지 확인하고 여기서 승인해요. 승인해야 서로 연락처가 공개돼요." },
  { tab: "행사 제어", selector: '[data-tutorial="lock-button"]', direction: "bottom", message: "장애가 의심되면 가장 먼저 이 '지금 접수 잠그기'부터 눌러주세요." },
];

const STORAGE_KEY = "mecam_admin_tutorial_done";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  currentTab: AdminTab;
  onNavigate: (tab: AdminTab) => void;
  forceOpen: boolean;
  onClose: () => void;
}

export function AdminTutorial({ currentTab, onNavigate, forceOpen, onClose }: Props) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setActive(true);
      return;
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setActive(true);
      }
    } catch {
      // storage에 접근할 수 없으면(프라이빗 모드 등) 튜토리얼 없이 그냥 진행한다.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen]);

  useEffect(() => {
    if (!active) return;
    const target = STEPS[step];
    if (currentTab !== target.tab) {
      onNavigate(target.tab);
    }
  }, [active, step, currentTab, onNavigate]);

  useLayoutEffect(() => {
    if (!active) return;
    const target = STEPS[step];
    if (currentTab !== target.tab) return;

    const measure = () => {
      const el = document.querySelector(target.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    };

    // 탭 전환 직후 렌더가 반영될 시간을 한 프레임 준다.
    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [active, step, currentTab]);

  const finish = () => {
    setActive(false);
    setRect(null);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 저장 실패해도 이번 세션에서는 이미 닫혔으니 무시한다.
    }
    onClose();
  };

  const advance = () => {
    if (step + 1 >= STEPS.length) {
      finish();
    } else {
      setStep(step + 1);
    }
  };

  if (!active) return null;

  const padding = 8;
  const spotlight: Rect | null = rect
    ? { top: rect.top - padding, left: rect.left - padding, width: rect.width + padding * 2, height: rect.height + padding * 2 }
    : null;
  const currentStep = STEPS[step];

  return (
    <div className="admin-tutorial">
      <div className="admin-tutorial__catcher" onClick={advance} />
      {spotlight ? (
        <div
          className="admin-tutorial__spotlight"
          style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }}
        />
      ) : null}
      {spotlight ? (
        <div className="admin-tutorial__bubble" style={bubblePosition(spotlight, currentStep.direction)} onClick={(e) => e.stopPropagation()}>
          <p>{currentStep.message}</p>
          <div className="admin-tutorial__bubble-footer">
            <span>
              {step + 1} / {STEPS.length}
            </span>
            <div className="admin-tutorial__bubble-actions">
              <button type="button" onClick={finish}>
                건너뛰기
              </button>
              <button type="button" onClick={advance}>
                {step + 1 >= STEPS.length ? "완료" : "다음"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function bubblePosition(spotlight: Rect, direction: TutorialStep["direction"]): CSSProperties {
  const gap = 14;
  switch (direction) {
    case "bottom":
      return { top: spotlight.top + spotlight.height + gap, left: Math.max(12, spotlight.left) };
    case "top":
      return { top: spotlight.top - gap, left: Math.max(12, spotlight.left), transform: "translateY(-100%)" };
    case "left":
      return { top: spotlight.top, left: spotlight.left - gap, transform: "translateX(-100%)" };
    case "right":
    default:
      return { top: spotlight.top, left: spotlight.left + spotlight.width + gap };
  }
}
