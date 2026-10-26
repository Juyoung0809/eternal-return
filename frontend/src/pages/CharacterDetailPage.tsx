import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useFetch } from "../hooks/useFetch";
import type { Skill } from "../api/types";

const SLOT_LABEL: Record<string, string> = {
  PASSIVE: "패시브",
  NORMAL_ATTACK: "기본 공격",
  SKILL_1: "스킬 1",
  SKILL_2: "스킬 2",
  SKILL_3: "스킬 3",
  SKILL_4: "스킬 4",
};

const SLOT_BADGE: Record<string, string> = {
  PASSIVE: "P",
  NORMAL_ATTACK: "A",
  SKILL_1: "1",
  SKILL_2: "2",
  SKILL_3: "3",
  SKILL_4: "4",
};

const SLOT_ORDER = ["PASSIVE", "SKILL_1", "SKILL_2", "SKILL_3", "SKILL_4"];

export default function CharacterDetailPage() {
  const { id } = useParams();
  const characterId = Number(id);
  const { data: character, loading, error } = useFetch(() => api.getCharacter(characterId), [characterId]);
  const [activeSlot, setActiveSlot] = useState<string>("PASSIVE");

  if (loading) return <p className="status">불러오는 중...</p>;
  if (error) return <p className="status status--error">에러: {error}</p>;
  if (!character) return <p className="status">캐릭터를 찾을 수 없습니다.</p>;

  const skillsBySlot = new Map<string, Skill>(character.skills.map((s) => [s.slot, s]));
  const orderedSlots = SLOT_ORDER.filter((slot) => skillsBySlot.has(slot));
  const activeSkill = skillsBySlot.get(activeSlot);

  return (
    <div>
      <Link to="/characters" className="back-link">
        ← 캐릭터 목록
      </Link>

      <div className="detail-layout">
        <div className="detail-left">
          <div className="detail-image">
            {character.imageUrl ? (
              <img src={character.imageUrl} alt={character.name} />
            ) : (
              <div className="card__thumb">{character.name[0]}</div>
            )}
          </div>
        </div>

        <div className="detail-right">
          <table className="info-table">
            <tbody>
              <tr>
                <td>이름</td>
                <td>{character.name}</td>
              </tr>
              <tr>
                <td>영문 이름</td>
                <td>{character.nameEn}</td>
              </tr>
              <tr>
                <td>사용 무기</td>
                <td>{character.weaponType || "정보 없음"}</td>
              </tr>
              <tr>
                <td>실험체 코드</td>
                <td>{character.code}</td>
              </tr>
              {character.description && (
                <tr>
                  <td>소개</td>
                  <td>{character.description}</td>
                </tr>
              )}
            </tbody>
          </table>

          {orderedSlots.length > 0 ? (
            <>
              <div className="options">
                {orderedSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={"option-button" + (activeSlot === slot ? " option-button--active" : "")}
                    onClick={() => setActiveSlot(slot)}
                  >
                    {SLOT_LABEL[slot]}
                  </button>
                ))}
              </div>

              <div className="content-display">
                {activeSkill && (
                  <>
                    <div className="skill-display">
                      <div className="skill-image-container">
                        <span className="skill-badge">{SLOT_BADGE[activeSkill.slot] ?? "?"}</span>
                        <div className="skill-name">{activeSkill.name}</div>
                      </div>
                      <div className="skill-text">{activeSkill.description || "설명이 없습니다."}</div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="status" style={{ padding: "1rem 0" }}>
              스킬 정보는 준비 중입니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
