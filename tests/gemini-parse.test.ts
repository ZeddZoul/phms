import { describe, expect, it } from 'vitest';
import { parseHealthAssessment } from '@/lib/gemini';

const validPayload = {
  health_score: 55,
  maize_score: 60,
  beans_score: 50,
  container_a_score: 90,
  container_a_status: 'Healthy',
  container_a_diagnosis: 'Plants look fine.',
  container_b_score: 30,
  container_b_status: 'Critical',
  container_b_diagnosis: 'Soil critically dry.',
  maize_a_score: 92,
  beans_a_score: 88,
  maize_b_score: 40,
  beans_b_score: 35,
  status: 'Critical',
  diagnosis: 'Container B is at risk.',
  recommended_actions: ['Water Container B now', 'Re-check in an hour'],
};

describe('parseHealthAssessment', () => {
  it('parses a full valid payload', () => {
    const result = parseHealthAssessment(JSON.stringify(validPayload));
    expect(result.health_score).toBe(55);
    expect(result.container_b_score).toBe(30);
    expect(result.container_b_status).toBe('Critical');
    expect(result.maize_a_score).toBe(92);
    expect(result.beans_b_score).toBe(35);
    expect(result.status).toBe('Critical');
    expect(result.recommended_actions).toHaveLength(2);
  });

  it('extracts JSON wrapped in prose or markdown fences', () => {
    const text = '```json\n' + JSON.stringify(validPayload) + '\n```';
    expect(parseHealthAssessment(text).health_score).toBe(55);
  });

  it('rejects the whole payload when health_score is out of range', () => {
    expect(
      parseHealthAssessment(JSON.stringify({ ...validPayload, health_score: 150 }))
    ).toEqual({});
  });

  it('rejects the whole payload on an invalid status', () => {
    expect(
      parseHealthAssessment(JSON.stringify({ ...validPayload, status: 'Perfect' }))
    ).toEqual({});
  });

  it('drops individual invalid optional fields without rejecting the rest', () => {
    const result = parseHealthAssessment(
      JSON.stringify({
        ...validPayload,
        maize_b_score: 999,
        container_a_status: 'Great',
      })
    );
    expect(result.health_score).toBe(55);
    expect(result.maize_b_score).toBeUndefined();
    expect(result.container_a_status).toBeUndefined();
  });

  it('filters non-string recommended actions', () => {
    const result = parseHealthAssessment(
      JSON.stringify({ ...validPayload, recommended_actions: ['ok', 42, null] })
    );
    expect(result.recommended_actions).toEqual(['ok']);
  });

  it('returns {} for non-JSON text', () => {
    expect(parseHealthAssessment('the plants look nice')).toEqual({});
  });
});
