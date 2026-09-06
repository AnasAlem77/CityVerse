import { AssistantService } from './assistant.service';

describe('AssistantService deterministic fallback', () => {
  const place = { placeId: 'place-1', name: 'Cafe One', category: 'restaurant', subtype: null, cityId: 'city-1', cityVerseScore: 12, reviewCount: 0 };
  function make(provider: { generateStructured: jest.Mock }) {
    const context = { resolve: jest.fn().mockResolvedValue({ cityId: 'city-1', cityName: 'Jakarta', category: 'restaurant', subtype: null, search: 'cafe' }), places: jest.fn().mockResolvedValue([place]), city: jest.fn().mockResolvedValue({ id: 'city-1', name: 'Jakarta' }), details: jest.fn() };
    const recommendations = { recommend: jest.fn().mockResolvedValue({ recommendations: [{ placeId: 'place-1' }] }) };
    return { service: new AssistantService({ detect: jest.fn().mockReturnValue({ intent: 'RECOMMENDATION' }) } as any, context as any, provider as any, recommendations as any, {} as any, {} as any, {} as any), context, recommendations };
  }

  it('returns real bounded places when AI generation is unavailable', async () => {
    const { service, context, recommendations } = make({ generateStructured: jest.fn().mockRejectedValue(new Error('not configured')) });
    const result = await service.ask({ message: 'I wanna go to a good cafe in Jakarta' });
    expect(result.unavailable).toBe(true);
    expect(result.places).toEqual([expect.objectContaining({ placeId: 'place-1', name: 'Cafe One', category: 'restaurant', cityVerseScore: 12, reason: 'Verified CityVerse result ranked without generative AI.' })]);
    expect(result.message).toContain('options in Jakarta');
    expect(context.resolve).toHaveBeenCalledWith('I wanna go to a good cafe in Jakarta', []);
    expect(recommendations.recommend).toHaveBeenCalledWith(expect.objectContaining({ category: 'restaurant', search: 'cafe' }));
  });

  it('keeps provider-generated explanations restricted to retrieved IDs', async () => {
    const provider = { generateStructured: jest.fn().mockResolvedValue({ message: 'Verified', placeIds: ['place-1', 'invented'] }) };
    const { service } = make(provider);
    const result = await service.ask({ message: 'Recommend a cafe in Jakarta' });
    expect(result.unavailable).toBeUndefined();
    expect(result.places.map((item) => item.placeId)).toEqual(['place-1']);
  });

  it('answers casual messages without retrieving or calling the provider', async () => {
    const provider = { generateStructured: jest.fn() };
    const context = { resolve: jest.fn(), places: jest.fn(), city: jest.fn(), details: jest.fn() };
    const service = new AssistantService({ detect: jest.fn().mockReturnValue({ intent: 'GENERAL_CITY_QUERY' }), isCasual: jest.fn().mockReturnValue(true) } as any, context as any, provider as any, {} as any, {} as any, {} as any, {} as any);
    const result = await service.ask({ message: 'hello bruh' });
    expect(result.intent).toBe('GENERAL_CITY_QUERY');
    expect(result.message).toMatch(/what's up/i);
    expect(context.resolve).not.toHaveBeenCalled();
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it('does not search for boredom or an opinion question', async () => {
    const provider = { generateStructured: jest.fn().mockRejectedValue(new Error('not configured')) };
    const context = { resolve: jest.fn(), places: jest.fn(), city: jest.fn(), details: jest.fn() };
    const service = new AssistantService({ detect: jest.fn().mockReturnValue({ intent: 'GENERAL_CITY_QUERY' }), isCasual: jest.fn().mockReturnValue(false), isGeneralQuestion: jest.fn().mockReturnValue(true) } as any, context as any, provider as any, {} as any, {} as any, {} as any, {} as any);
    const result = await service.ask({ message: 'btw what do u think is better tokyo or paris 😂' });
    expect(result.intent).toBe('GENERAL_CITY_QUERY');
    expect(result.places).toEqual([]);
    expect(context.resolve).not.toHaveBeenCalled();
    expect(context.places).not.toHaveBeenCalled();
  });

  it('continues a pending city clarification when the user answers yes', async () => {
    const context = { resolve: jest.fn(), places: jest.fn(), city: jest.fn(), details: jest.fn() };
    const service = new AssistantService({ detect: jest.fn().mockReturnValue({ intent: 'GENERAL_CITY_QUERY' }), isCasual: jest.fn().mockReturnValue(false), isGeneralQuestion: jest.fn().mockReturnValue(false) } as any, context as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const result = await service.ask({ message: 'yeah', history: [{ role: 'assistant', content: 'Want to get out somewhere?' }] });
    expect(result.message).toMatch(/what city/i);
    expect(context.resolve).not.toHaveBeenCalled();
  });

  it('asks for one missing city instead of issuing an incomplete search', async () => {
    const provider = { generateStructured: jest.fn() };
    const context = { resolve: jest.fn().mockResolvedValue({ category: 'restaurant' }), places: jest.fn(), city: jest.fn(), details: jest.fn() };
    const service = new AssistantService({ detect: jest.fn().mockReturnValue({ intent: 'RECOMMENDATION' }), isCasual: jest.fn().mockReturnValue(false), isFollowUp: jest.fn().mockReturnValue(false) } as any, context as any, provider as any, {} as any, {} as any, {} as any, {} as any);
    const result = await service.ask({ message: 'my mom wants Arabic food' });
    expect(result.clarification).toContain('city');
    expect(result.message).toMatch(/which city/i);
    expect(context.places).not.toHaveBeenCalled();
  });

  it('carries city and category from bounded user history into a follow-up', async () => {
    const provider = { generateStructured: jest.fn().mockRejectedValue(new Error('not configured')) };
    const context = { resolve: jest.fn().mockResolvedValue({ cityId: 'city-1', cityName: 'Jakarta', category: 'restaurant', subtype: 'coffee' }), places: jest.fn().mockResolvedValue([place]), city: jest.fn().mockResolvedValue({ id: 'city-1', name: 'Jakarta' }), details: jest.fn() };
    const recommendations = { recommend: jest.fn().mockResolvedValue({ recommendations: [{ placeId: 'place-1' }] }) };
    const service = new AssistantService({ detect: jest.fn().mockReturnValue({ intent: 'GENERAL_CITY_QUERY' }), isCasual: jest.fn().mockReturnValue(false), isFollowUp: jest.fn().mockReturnValue(true) } as any, context as any, provider as any, recommendations as any, {} as any, {} as any, {} as any);
    const result = await service.ask({ message: 'something cheaper', history: [{ role: 'user', content: 'find coffee in Jakarta' }, { role: 'assistant', content: 'I found some options.' }] });
    expect(result.places).toHaveLength(1);
    expect(recommendations.recommend).toHaveBeenCalledWith(expect.objectContaining({ cityId: 'city-1', category: 'restaurant', subtype: 'coffee' }));
  });
});
