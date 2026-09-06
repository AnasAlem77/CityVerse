import { Injectable } from '@nestjs/common';
import { AssistantIntent } from './assistant.types';

@Injectable()
export class IntentService {
  detect(message: string): { intent: AssistantIntent; city?: string; category?: string; subtype?: string } {
    const text = message.toLowerCase();
    const categories = ['restaurant', 'hotel', 'attraction', 'shop', 'hospital', 'university'];
    const category = categories.find((value) => text.includes(value));
    const nearby = /near me|nearby|close to me/.test(text);
    if (/weather|temperature|forecast/.test(text)) return { intent: 'WEATHER' };
    if (/alert|warning|emergency/.test(text)) return { intent: 'ALERTS' };
    if (/route|directions|how do i get|how long|from .* to /.test(text)) return { intent: 'ROUTING' };
    if (/tell me (more )?about|details|information about|what can you tell me/.test(text)) return { intent: 'PLACE_DETAILS' };
    if (/similar|recommend|best|which one|closest|nice place|somewhere nice|suggest|good .* (place|restaurant|hotel|cafe)|i wanna go|i want to go|go to|want a|want to find|need a|looking for|where can i eat|where can i get|gimme|give me|cafe|café|coffee|laundry|gift|beach|supermarket|convenience|arabic food/.test(text)) return { intent: 'RECOMMENDATION', category };
    if (nearby) return { intent: 'NEARBY_PLACES', category };
    if (category || /find|show|where|places/.test(text)) return { intent: 'PLACE_SEARCH', category };
    if (/city|visit|explore|things to do/.test(text)) return { intent: 'CITY_INFORMATION' };
    return { intent: 'GENERAL_CITY_QUERY' };
  }

  isCasual(message: string) {
    const text = message.trim().toLowerCase();
    return /^(hi|hello|hey|heyy+|yo|sup|what's up|whats up|how are you|how u doing|how's it going|hows it going|im bored|i'm bored|im tired|i'm tired)(\s+bruh|\s+bro|\s+as hell)?[!.?😂😎 ]*$/i.test(text)
      || /^(i'?m good|doing good|fine|fine hbu|good hbu|great|thanks|thank you)[!.? ]*$/i.test(text);
  }

  isGeneralQuestion(message: string) {
    const text = message.trim().toLowerCase();
    return /what do u think|what do you think|which one do you prefer|better .+ or .+|which city has better|what('?s| is) .+ like/.test(text)
      && !/find|show|recommend|where can|gimme|give me|looking for|places?/.test(text);
  }

  isFollowUp(message: string) {
    return /^(nah|no|not that|anything else|what else|give me another|another one|more like|something cheaper|cheaper|too expensive|boring|near that|near the|around that|around the|what about|surprise me|something (quiet|fancy|cozy))/.test(message.trim().toLowerCase());
  }
}
