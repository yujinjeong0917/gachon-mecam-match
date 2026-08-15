-- 매칭 로직 검증용 시드 데이터. 실제 서비스 데이터가 아니다.

insert into public.events (id, slug, name, starts_at, ends_at, status)
values ('11111111-1111-1111-1111-111111111111', 'gachon-medical-fall-2026', '72시간 소개팅', '2026-09-21 10:00+09', '2026-09-22 18:00+09', 'registration_open');

insert into public.event_features (event_id) values ('11111111-1111-1111-1111-111111111111');

do $$
declare
  v_event uuid := '11111111-1111-1111-1111-111111111111';
  seed_data jsonb := '[
    {"nickname":"가을밤","dept":"간호학과","grade":2,"gender":"female","mbti":"ENFP","one_liner":"같이 카페 투어 다니고 싶어요","self_traits":["차분함","다정함"],"desired_traits":["활발함","유쾌함"],"interests":["카페","여행","공연"],"activities":["카페 투어","전시·공연 관람"],"food":["디저트","카페 투어"],"music":["팝"],"conv":"먼저 연락받는 걸 선호해요","seeking":["male"],"grades":[2,3,4]},
    {"nickname":"달빛","dept":"물리치료학과","grade":3,"gender":"male","mbti":"ENFP","one_liner":"같이 맛있는 거 먹으러 가고 싶어요","self_traits":["활발함","다정함"],"desired_traits":["차분함","다정함"],"interests":["카페","여행","음악"],"activities":["카페 투어","맛집 탐방"],"food":["디저트","고기"],"music":["팝","인디"],"conv":"먼저 연락받는 걸 선호해요","seeking":["female"],"grades":[1,2,3]},
    {"nickname":"별똥별","dept":"작업치료학과","grade":2,"gender":"female","mbti":"ISTJ","one_liner":"운동 좋아해요","self_traits":["조용함","섬세함"],"desired_traits":["차분함","섬세함"],"interests":["운동","독서"],"activities":["산책·러닝"],"food":["매운 음식"],"music":["재즈"],"conv":"제가 먼저 연락할게요","seeking":["male"],"grades":[2,3]},
    {"nickname":"산책자","dept":"임상병리학과","grade":3,"gender":"male","mbti":"ISTJ","one_liner":"러닝 같이 해요","self_traits":["차분함","섬세함"],"desired_traits":["조용함","섬세함"],"interests":["운동","독서","사진"],"activities":["산책·러닝","사진 촬영"],"food":["매운 음식"],"music":["재즈","팝"],"conv":"제가 먼저 연락할게요","seeking":["female"],"grades":[1,2,3]},
    {"nickname":"봄바람","dept":"응급구조학과","grade":1,"gender":"female","mbti":"ESFP","one_liner":"보드게임 좋아해요","self_traits":["유쾌함","장난기 많음"],"desired_traits":["활발함","장난기 많음"],"interests":["게임","공연"],"activities":["보드게임","전시·공연 관람"],"food":["매운 음식","분식"],"music":["힙합"],"conv":"편한 대로 해요","seeking":["male","any"],"grades":[1,2,3,4]},
    {"nickname":"우주인","dept":"방사선학과","grade":2,"gender":"male","mbti":"ESFP","one_liner":"게임 같이 해요","self_traits":["장난기 많음","유쾌함"],"desired_traits":["유쾌함","장난기 많음"],"interests":["게임","공연","사진"],"activities":["보드게임","사진 촬영"],"food":["분식","고기"],"music":["힙합","팝"],"conv":"편한 대로 해요","seeking":["female"],"grades":[1,2,3]},
    {"nickname":"고요","dept":"치위생학과","grade":4,"gender":"female","mbti":"INFJ","one_liner":"책 좋아해요","self_traits":["조용함","차분함"],"desired_traits":["조용함","차분함"],"interests":["독서","봉사활동"],"activities":["산책·러닝"],"food":["카페 투어"],"music":["클래식"],"conv":"제가 먼저 연락할게요","seeking":["male"],"grades":[3,4]},
    {"nickname":"들풀","dept":"물리치료학과","grade":4,"gender":"male","mbti":"INFJ","one_liner":"봉사활동 같이 해요","self_traits":["차분함","조용함"],"desired_traits":["조용함","섬세함"],"interests":["독서","봉사활동","스터디"],"activities":["산책·러닝"],"food":["카페 투어"],"music":["클래식","재즈"],"conv":"제가 먼저 연락할게요","seeking":["female"],"grades":[3,4]},
    {"nickname":"파도","dept":"간호학과","grade":1,"gender":"female","mbti":"ENTP","one_liner":"드라이브 좋아해요","self_traits":["활발함","리더십 있음"],"desired_traits":["유쾌함","리더십 있음"],"interests":["드라이브","여행"],"activities":["맛집 탐방"],"food":["고기"],"music":["팝"],"conv":"먼저 연락받는 걸 선호해요","seeking":["male"],"grades":[1,2]},
    {"nickname":"바람개비","dept":"응급구조학과","grade":1,"gender":"male","mbti":"ENTP","one_liner":"여행 자주 가요","self_traits":["리더십 있음","활발함"],"desired_traits":["활발함","리더십 있음"],"interests":["드라이브","여행","공연"],"activities":["맛집 탐방","전시·공연 관람"],"food":["고기","분식"],"music":["팝","힙합"],"conv":"먼저 연락받는 걸 선호해요","seeking":["female"],"grades":[1,2]},
    {"nickname":"민들레","dept":"작업치료학과","grade":3,"gender":"female","mbti":"ISFJ","one_liner":"스터디 같이 해요","self_traits":["섬세함","조용함"],"desired_traits":["차분함","다정함"],"interests":["스터디","독서"],"activities":["산책·러닝"],"food":["디저트"],"music":["재즈"],"conv":"편한 대로 해요","seeking":["male","any"],"grades":[2,3,4]},
    {"nickname":"단풍","dept":"임상병리학과","grade":2,"gender":"male","mbti":"ISFJ","one_liner":"조용한 카페 좋아해요","self_traits":["섬세함","다정함"],"desired_traits":["섬세함","조용함"],"interests":["카페","독서"],"activities":["카페 투어"],"food":["디저트","카페 투어"],"music":["재즈","클래식"],"conv":"편한 대로 해요","seeking":["female"],"grades":[2,3]},
    {"nickname":"은하수","dept":"치위생학과","grade":2,"gender":"female","mbti":"ENFP","one_liner":"사진 찍는 거 좋아해요","self_traits":["다정함","활발함"],"desired_traits":["차분함","섬세함"],"interests":["사진","여행"],"activities":["사진 촬영"],"food":["디저트"],"music":["팝"],"conv":"먼저 연락받는 걸 선호해요","seeking":["male"],"grades":[2,3,4]},
    {"nickname":"오솔길","dept":"방사선학과","grade":4,"gender":"male","mbti":"INTJ","one_liner":"전시 보러 다녀요","self_traits":["차분함","섬세함"],"desired_traits":["다정함","활발함"],"interests":["사진","공연"],"activities":["전시·공연 관람","사진 촬영"],"food":["카페 투어"],"music":["인디"],"conv":"제가 먼저 연락할게요","seeking":["female"],"grades":[2,3,4]}
  ]'::jsonb;
  rec jsonb;
  v_participant uuid;
  v_i int := 0;
begin
  for rec in select * from jsonb_array_elements(seed_data)
  loop
    v_i := v_i + 1;
    insert into private.participants (event_id, matching_number, recovery_code_hash, status, age_18_plus, submitted_at)
    values (v_event, 'M-' || lpad(v_i::text, 3, '0'), md5(random()::text), 'waiting', true, now() - (v_i || ' minutes')::interval)
    returning id into v_participant;

    insert into private.profiles (participant_id, nickname, department, grade, gender_code, mbti, one_liner)
    values (v_participant, rec->>'nickname', rec->>'dept', (rec->>'grade')::int, rec->>'gender', rec->>'mbti', rec->>'one_liner');

    insert into private.preferences (participant_id, seeking_gender_codes, preferred_grades, self_traits, desired_traits, interests, activities, food_tags, music_tags, conversation_style)
    values (
      v_participant,
      (select array_agg(x) from jsonb_array_elements_text(rec->'seeking') x),
      (select array_agg(x::int) from jsonb_array_elements_text(rec->'grades') x),
      (select array_agg(x) from jsonb_array_elements_text(rec->'self_traits') x),
      (select array_agg(x) from jsonb_array_elements_text(rec->'desired_traits') x),
      (select array_agg(x) from jsonb_array_elements_text(rec->'interests') x),
      (select array_agg(x) from jsonb_array_elements_text(rec->'activities') x),
      (select array_agg(x) from jsonb_array_elements_text(rec->'food') x),
      (select array_agg(x) from jsonb_array_elements_text(rec->'music') x),
      rec->>'conv'
    );

    insert into private.consents (participant_id, policy_version, age_18_plus, participation, profile_share, instagram_share_if_matched, analytics)
    values (v_participant, '2026-09-01', true, true, true, true, false);

    insert into private.private_contacts (participant_id, event_id, instagram_handle, phone_number, contact_preference)
    values (v_participant, v_event, lower(rec->>'nickname') || '_ig', '010-' || lpad(v_i::text, 4, '0') || '-' || lpad((v_i * 7 % 10000)::text, 4, '0'), rec->>'conv');
  end loop;
end $$;
