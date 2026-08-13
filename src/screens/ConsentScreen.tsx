import { useState } from "react";
import { Button } from "../components/Button";
import "./ConsentScreen.css";

interface ConsentState {
  participation: boolean;
  profileShare: boolean;
  instagramShare: boolean;
  analytics: boolean;
}

interface Props {
  onSubmit: (consents: ConsentState) => void;
}

/** 문서01 §3.2: 필수 동의 3개(참여/상대공개정보/Instagram공개)를 각각 구분. 문서02 §4.2: 선택적 분석동의는 별도 분리. */
export function ConsentScreen({ onSubmit }: Props) {
  const [consents, setConsents] = useState<ConsentState>({
    participation: false,
    profileShare: false,
    instagramShare: false,
    analytics: false,
  });
  const [accordionOpen, setAccordionOpen] = useState(false);

  const requiredChecked = consents.participation && consents.profileShare && consents.instagramShare;

  const toggle = (key: keyof ConsentState) => setConsents((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <section className="consent">
      <h1 className="consent__title">참여 전 꼭 확인해 주세요</h1>

      <label className="consent__row">
        <input type="checkbox" checked={consents.participation} onChange={() => toggle("participation")} />
        <span>
          <strong>[필수]</strong> 매칭 프로그램 참여에 동의해요
        </span>
      </label>

      <label className="consent__row">
        <input type="checkbox" checked={consents.profileShare} onChange={() => toggle("profileShare")} />
        <span>
          <strong>[필수]</strong> 닉네임·학과·학년 등 기본 정보가 매칭 상대에게 공개되는 것에 동의해요
        </span>
      </label>

      <label className="consent__row">
        <input type="checkbox" checked={consents.instagramShare} onChange={() => toggle("instagramShare")} />
        <span>
          <strong>[필수]</strong> 매칭이 성사되고 상대방이 공식 계정 팔로우 인증을 완료하면, 내가 입력한 Instagram ID와
          연락 선호 정보가 매칭 상대 1명에게 공개돼요. 공개 정보는 행사 종료 후 7일 이내 삭제해요.
        </span>
      </label>

      <label className="consent__row consent__row--optional">
        <input type="checkbox" checked={consents.analytics} onChange={() => toggle("analytics")} />
        <span>[선택] 서비스 개선을 위한 익명 분석(GA4)에 동의해요</span>
      </label>

      <div className="consent__accordion">
        <button type="button" className="consent__accordion-trigger" aria-expanded={accordionOpen} onClick={() => setAccordionOpen((v) => !v)}>
          개인정보 수집 항목·이용 목적·보관 기간 자세히 보기
          <span aria-hidden="true">{accordionOpen ? "-" : "+"}</span>
        </button>
        {accordionOpen ? (
          <div className="consent__accordion-body">
            <p>수집 항목: 닉네임, 학과, 학년, 성별, MBTI(선택), 취향·성격 태그, 한마디, Instagram ID, 연락 선호</p>
            <p>이용 목적: 상호 취향 기반 1:1 매칭 계산과 매칭 상대 공개</p>
            <p>보관 기간: 행사 종료 후 7일 이내 식별정보 삭제, 이후 비식별 집계만 보존</p>
            <p>상대 공개 항목: 닉네임, 학과, 학년, MBTI, 성격 태그, 공통 관심사, 한마디. Instagram ID는 팔로우 인증 후에만.</p>
          </div>
        ) : null}
      </div>

      <Button variant="primary" disabled={!requiredChecked} onClick={() => onSubmit(consents)}>
        동의하고 설문 시작하기
      </Button>
    </section>
  );
}
