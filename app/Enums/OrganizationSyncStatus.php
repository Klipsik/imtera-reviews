<?php

namespace App\Enums;

enum OrganizationSyncStatus: string
{
    case Pending = 'pending';
    case ParsingOrg = 'parsing_org';
    case ParsingReviews = 'parsing_reviews';
    case Saving = 'saving';
    case Completed = 'completed';
    case Failed = 'failed';
}
