export const getProfileAvatarInitial = (profileName?: string | null) => {
  const trimmedProfileName = profileName?.trim();

  return trimmedProfileName ? trimmedProfileName.charAt(0).toUpperCase() : '';
};
