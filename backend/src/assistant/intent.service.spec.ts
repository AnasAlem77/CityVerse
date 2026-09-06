import { IntentService } from './intent.service';

describe('IntentService', () => {
  const service = new IntentService();
  it('detects category searches', () => expect(service.detect('Find restaurants in Paris').intent).toBe('PLACE_SEARCH'));
  it('detects nearby queries', () => expect(service.detect('Show restaurants near me').intent).toBe('NEARBY_PLACES'));
  it('detects weather queries', () => expect(service.detect('What is the weather in Tokyo?').intent).toBe('WEATHER'));
  it('extracts a category without city-specific logic', () => expect(service.detect('Recommend a hotel').category).toBe('hotel'));
  it('recognizes casual conversation without turning it into a place query', () => {
    expect(service.isCasual('hello bruh')).toBe(true);
    expect(service.detect('hello bruh').intent).toBe('GENERAL_CITY_QUERY');
  });
  it('recognizes natural recommendation language and follow-ups', () => {
    expect(service.detect('bruh gimme a good coffee place').intent).toBe('RECOMMENDATION');
    expect(service.isFollowUp('nah too expensive')).toBe(true);
    expect(service.isFollowUp('what about near that one?')).toBe(true);
  });
});
